import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { formatGender } from './app.util';
import axios from 'axios';
@Injectable()
export class AppService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  // handleVerificationButtonClick(query: any, res: Response) {
  //   const userToken = query.token;
  //   const clientId = this.configService.get<string>('CLIENT_ID');
  //   const redirectUri = this.configService.get<string>('REDIRECT_URI');

  //   res.cookie('jwt', userToken, {
  //     httpOnly: true,
  //     secure: false,
  //     maxAge: 3600000,
  //   });

  //   try {
  //     res.redirect(
  //       `https://idhub.kku.ac.th/api/v1/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=login`,
  //     );
  //   } catch (error) {
  //     console.error('Error while processing JWT:', error);
  //     res.status(500).json({ error: 'Failed to process request' });
  //   }
  // }

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
    try {
      const client_id = this.getConfigValue('CLIENT_ID');
      const client_secret = this.getConfigValue('CLIENT_SECRET');

      const idHubResponse = await firstValueFrom(
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

      console.log('Token Response:', idHubResponse.data);

      return this.jwtService.decode(idHubResponse.data.id_token);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        if (status === HttpStatus.UNAUTHORIZED)
          throw new UnauthorizedException('Unauthorized access');
        if (status === HttpStatus.FORBIDDEN)
          throw new ForbiddenException('Authorization expired');
      }
      throw new BadRequestException('Failed to verify user on ThaiD');
    }
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
      const { state: username, code } = query;
      if (!username || !code)
        throw new BadRequestException('Invalid request parameters');

      // const decodedToken: any = await this.fetchThaiDToken(code);
      const decodedToken: any = {
        at_hash: 'iXKHB6rXgR71IUc84h-dMQ',
        aud: 'U3haSW5oVzZ5aDVCeEZHR2JSTEFZMDRrVTNOM1dpbnQ',
        exp: 1729498916,
        iat: 1729498016,
        iss: 'https://imauth.bora.dopa.go.th',
        sub: '1100400416571',
        pid: '1100400416571',
        name: 'นาย ธนภูมิ ชัยณรงค์โสภณ',
        name_en: 'Mr. Thanapoom Chainarongsophon',
        birthdate: '1989-10-03',
        address: {
          formatted: '694/31 ซ.พญานาค แขวงถนนเพชรบุรี เขตราชเทวี กรุงเทพมหานคร',
        },
        given_name: 'ธนภูมิ',
        given_name_en: 'Thanapoom',
        family_name: 'ชัยณรงค์โสภณ',
        family_name_en: 'Chainarongsophon',
        middle_name: '',
        middle_name_en: '',
        gender: 'male',
        titleTh: 'นาย',
        titleEn: 'Mr.',
        cardCreated: '2022-01-10',
        cardExpired: '2030-10-02',
        smartCardCode: '1037-03-01100956',
        ial: '2.3',
        version: 2,
        auth_time: 1729498016,
      };

      decodedToken.titleEn = decodedToken.titleEn.toUpperCase();
      decodedToken.gender = formatGender(decodedToken.gender);

      const personNumber = await this.fetchUserPersonNumber(username);
      const workerInformation = await this.fetchWorkerInformation(personNumber);

      const nationalIdentifier =
        workerInformation.nationalIdentifiers[0]?.NationalIdentifierNumber;
      if (nationalIdentifier !== decodedToken.pid) {
        throw new ForbiddenException(
          'National Identifier mismatch, Unable to update Person Information',
        );
      }

      const updateWorkerInformationUrl = workerInformation.links[0].href;

      const body = this.buildWorkerUpdateBody(decodedToken, workerInformation);
      console.log('Body:', body);

      const apiConfig = this.buildApiConfig();

      const apiResponse = await firstValueFrom(
        this.httpService.patch(updateWorkerInformationUrl, body, apiConfig),
      );

      console.log('API Response:', apiResponse.data);

      res.status(200).json({ message: 'Information updated successfully' });

      // res.redirect(this.getConfigValue('CLOUD_ENVIRONMENT'));
    } catch (error) {
      console.error('Error in Update Worker Api:', error);
      this.handleError(error);
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
      // addresses: [
      //   {
      //     AddressId: Number(workerData.addresses[0].AddressId),
      //     AddressLine1: '190 3',
      //     TownOrCity: 'เมืองนครราชสีมา',
      //     Region1: 'มะเริง',
      //     Region2: 'Northeastern 1',
      //     Region3: 'นครราชสีมา',
      //     PersonAddrUsageId: Number(workerData.addresses[0].PersonAddrUsageId),
      //     AddressType: 'MAIL',
      //   },
      // ],
    };
  }

  private buildApiConfig() {
    const today = new Date().toISOString().split('T')[0];
    return {
      headers: {
        'Effective-Of': `RangeMode=REPLACE_UPDATE; RangeStartDate=${today}; RangeSpan=LOGICAL_ROW_END_DATE`,
        'Content-Type': 'application/json',
      },
      ...this.getApiAuthConfig(),
    };
  }

  private handleError(error: any): never {
    console.error('Error in Update Worker API:', error.response);

    if (axios.isAxiosError(error)) {
      const { response } = error;

      if (response) {
        const { status, data } = response;
        if (status === HttpStatus.UNAUTHORIZED) {
          throw new UnauthorizedException('Unable to Verify User Identity');
        }
        throw new BadRequestException(`Error: ${status} - ${data}`);
      }
      throw new InternalServerErrorException('Network error occurred');
    }

    if (
      error instanceof BadRequestException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    }

    throw new InternalServerErrorException('An unexpected error occurred');
  }
}
