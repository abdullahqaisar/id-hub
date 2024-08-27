import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getReqParams(query: any, res: Response): Promise<void> {
    console.log('Query Params:', query);

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
      const response = await firstValueFrom(
        this.httpService.post(
          'https://id-hub.vercel.app/callback-url?abd=xyz&param=a',
          data,
          config,
        ),
      );

      console.log('Response:', response);

      // Redirect to a specific URL
      res.redirect('https://login-iaajtj-dev2.fa.ocs.oraclecloud.com/');
    } catch (error) {
      throw error;
    }
  }
}
