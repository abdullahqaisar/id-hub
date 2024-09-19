import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AppService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async getReqParams(query: any, res: Response): Promise<void> {
    console.log('Request Query:', query);

    const clientId = this.configService.get<string>('CLIENT_ID');
    const clientSecret = this.configService.get<string>('CLIENT_SECRET');

    const data = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      response_type: 'code',
      redirect_uri: 'https://id-hub.vercel.app/callback-url',
      code: query.code,
    };

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'cache-control': 'no-cache',
      },
    };

    try {
      console.log('Before Api Call');
      const response = await firstValueFrom(
        this.httpService.post(
          'https://idhub.kku.ac.th/api/v1/oauth2/token',
          data,
          config,
        ),
      );

      const decodedToken = this.jwtService.decode(response.data.id_token);

      const {
        name,
        name_en,
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
        pid,
      } = decodedToken;

      // address in address.formated

      res.redirect('https://login-iaajtj-dev2.fa.ocs.oraclecloud.com/');
    } catch (error) {
      throw error;
    }
  }

  handleVerificationButtonClick(query: any, res: Response) {
    const userToken = query.jwt;

    console.log('User Token:', userToken);

    try {
      // Step 1: Fetch and decode the token
      // Step 2: Store the token or user info (Optional)
      // await this.cacheManager.set(pid, response.data.id_token); // Example to store in cache
      // // Step 3: Redirect to QR code scan page
      // res.redirect(`https://your-app.com/qr-code-scan?name=${name}&pid=${pid}`);
    } catch (error) {
      console.error('Error while processing JWT:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }
}
