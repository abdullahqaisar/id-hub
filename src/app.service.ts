import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { formatGender } from './app.util';
@Injectable()
export class AppService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  handleVerificationButtonClick(query: any, res: Response) {
    const userToken = query.token;
    const clientId = this.configService.get<string>('CLIENT_ID');
    const redirectUri = this.configService.get<string>('REDIRECT_URI');

    res.cookie('jwt', userToken, {
      httpOnly: true,
      secure: false,
      maxAge: 3600000,
    });

    try {
      res.redirect(
        `https://idhub.kku.ac.th/api/v1/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=login`,
      );
    } catch (error) {
      console.error('Error while processing JWT:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }

  private getConfigValue(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new Error(`Missing environment value for ${key}`);
    return value;
  }

  private getApiAuthConfig() {
    return {
      auth: {
        username: this.getConfigValue('SERVICE_ACC_USERNAME'),
        password: this.getConfigValue('SERVICE_ACC_PASSWORD'),
      },
    };
  }

  private async fetchThaiDToken(code: string) {
    const client_id = this.getConfigValue('CLIENT_ID');
    const client_secret = this.getConfigValue('CLIENT_SECRET');

    const tokenResponse = await firstValueFrom(
      this.httpService.post(
        'https://idhub.kku.ac.th/api/v1/oauth2/token',
        {
          client_id,
          client_secret,
          grant_type: 'authorization_code',
          response_type: 'code',
          redirect_uri: 'https://id-hub.vercel.app/callback-url',
          code,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cache-Control': 'no-cache',
          },
        },
      ),
    );

    if (tokenResponse.status !== 200) {
      throw new BadRequestException('Failed to verify user on ThaiD');
    }

    return this.jwtService.decode(tokenResponse.data.id_token);
  }

  private async fetchUserPersonNumber(username: string) {
    const apiUrl = `${this.getConfigValue('CLOUD_ENVIRONMENT')}/hcmRestApi/resources/11.13.18.05/userAccounts`;
    const response = await firstValueFrom(
      this.httpService.get(
        `${apiUrl}?q=Username=${username}`,
        this.getApiAuthConfig(),
      ),
    );

    if (response.status !== 200 || response.data.items.length === 0) {
      throw new BadRequestException('User not found');
    }
    return response.data.items[0].PersonNumber;
  }

  private async fetchWorkerInformation(personNumber: string) {
    const apiUrl = `${this.getConfigValue('CLOUD_ENVIRONMENT')}/hcmRestApi/resources/11.13.18.05/workers`;
    const response = await firstValueFrom(
      this.httpService.get(
        `${apiUrl}?q=PersonNumber=${personNumber}&expand=legislativeInfo,names,addresses,nationalIdentifiers`,
        this.getApiAuthConfig(),
      ),
    );

    if (response.data.items.length === 0) {
      throw new BadRequestException(
        'Worker information not found in Fusion Cloud HCM',
      );
    }

    return response.data.items[0];
  }

  async updateWorker(query: any, req: Request, res: Response): Promise<void> {
    try {
      const { username, code } = query;
      if (!username || !code)
        throw new BadRequestException('Invalid request parameters');

      // const decodedToken: any = await this.fetchThaiDToken(code);
      const decodedToken = {
        birthdate: '2000-08-11',
        address: 'Address Line3',
        gender: 'male',
        given_name: 'John',
        given_name_en: 'John',
        middle_name: 'A.',
        middle_name_en: 'A.',
        family_name: 'Doe',
        family_name_en: 'Doe',
        titleEn: 'Mr.',
        titleTh: 'คุณ',
        pid: '1409901168893',
      };

      decodedToken.titleEn = decodedToken.titleEn.toUpperCase();
      decodedToken.gender = formatGender(decodedToken.gender);

      const personNumber = await this.fetchUserPersonNumber(username);
      const workerInformation = await this.fetchWorkerInformation(personNumber);

      // const nationalIdentifier =
      //   workerInformation.nationalIdentifiers[0]?.NationalIdentifierNumber;
      // if (nationalIdentifier !== decodedToken.pid) {
      //   throw new UnauthorizedException(
      //     'National Identifier mismatch, Unable to update Person Information',
      //   );
      // }

      const today = new Date().toISOString().split('T')[0];
      const updateWorkerInformationUrl = workerInformation.links[0].href;

      const body = this.buildWorkerUpdateBody(decodedToken, workerInformation);
      const apiConfig = this.buildApiConfig(today);

      const apiResponse = await firstValueFrom(
        this.httpService.patch(updateWorkerInformationUrl, body, apiConfig),
      );

      console.log('API Response:', apiResponse.data);

      res.status(200).json({ message: 'Information updated successfully' });

      // res.redirect(this.getConfigValue('CLOUD_ENVIRONMENT'));
    } catch (error) {
      console.error('Error in Update Worker Api:', error);
      throw error;
    }
  }

  private buildWorkerUpdateBody(tokenData: any, workerData: any) {
    const {
      birthdate,
      address,
      gender,
      given_name,
      given_name_en,
      middle_name,
      middle_name_en,
      family_name,
      family_name_en,
      titleEn,
      titleTh,
    } = tokenData;

    return {
      DateOfBirth: birthdate,
      names: [
        {
          PersonNameId: workerData.names[0].PersonNameId,
          Title: titleEn,
          FirstName: given_name,
          MiddleNames: middle_name,
          LastName: family_name,
          LocalFirstName: given_name_en,
          LocalMiddleNames: middle_name_en,
          LocalLastName: family_name_en,
        },
      ],
      legislativeInfo: [
        {
          PersonLegislativeId:
            workerData.legislativeInfo[0].PersonLegislativeId,
          Gender: gender,
          LegislationCode: 'TH',
        },
      ],
      addresses: [
        {
          AddressLine1: address,
          TownOrCity: 'Town City',
          Region1: 'สาวะถี',
          Region2: 'Northeastern 2',
          Region3: 'ขอนแก่น',
          Country: 'TH',
          PostalCode: '40000',
          PersonAddrUsageId: Number(workerData.addresses[0].PersonAddrUsageId),
          AddressType: 'MAIL',
        },
      ],
    };
  }

  private buildApiConfig(effectiveDate: string) {
    return {
      headers: {
        'Effective-Of': `RangeMode=UPDATE; RangeStartDate=${effectiveDate}`,
        'Content-Type': 'application/json',
      },
      ...this.getApiAuthConfig(),
    };
  }
}
