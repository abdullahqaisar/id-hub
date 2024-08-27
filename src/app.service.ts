import { Injectable } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class AppService {
  getReqParams(query: any, res: Response): void {
    console.log('Query Params:', query);
    // Redirect to a specific URL
    res.redirect('https://login-iaajtj-dev2.fa.ocs.oraclecloud.com/');
  }
}
