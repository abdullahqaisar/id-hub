import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getReqParams(query): string {
    console.log('Query Params:', query);
    return 'Request Logged';
  }
}
