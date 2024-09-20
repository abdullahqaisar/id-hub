import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
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

  handleVerificationButtonClick(query: any, res: Response) {
    const userToken = query.jwt;
    console.log('User Token:', userToken);

    res.cookie('jwt', userToken, {
      httpOnly: true,
      secure: false,
      maxAge: 3600000,
    });

    try {
      res.redirect(
        'https://idhub.kku.ac.th/api/v1/oauth2/auth?response_type=code&client_id=8deb9666-1c0d-43a4-bccf-52095609cc53&redirect_uri=https://id-hub.vercel.app/callback-url&state=login',
      );
    } catch (error) {
      console.error('Error while processing JWT:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }

  async getReqParams(query: any, req: Request, res: Response): Promise<void> {
    const clientId = this.configService.get<string>('CLIENT_ID');
    const clientSecret = this.configService.get<string>('CLIENT_SECRET');
    const jwt = req.cookies.jwt;
    console.log('JWT Cookie: ', jwt);

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
      const response = await firstValueFrom(
        this.httpService.post(
          'https://idhub.kku.ac.th/api/v1/oauth2/token',
          data,
          config,
        ),
      );

      const decodedToken = this.jwtService.decode(response.data.id_token);

      const cloudEnvironment =
        this.configService.get<string>('CLOUD_ENVIRONMENT');
      const oracleCloudApiUrl = `${cloudEnvironment}/hcmRestApi/resources/11.13.18.05/workers`;

      const apiConfig = {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      };

      const body = {
        name_en: decodedToken.name_en,
      };

      const apiResponse = await firstValueFrom(
        this.httpService.post(oracleCloudApiUrl, body, apiConfig),
      );

      console.log('API Response:', apiResponse.data);

      res.redirect(cloudEnvironment);
    } catch (error) {
      throw error;
    }
  }
}
