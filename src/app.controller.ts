import { Controller, Get, Query, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('callback-url')
  async getReqParams(@Query() query: any, @Res() res: Response): Promise<void> {
    await this.appService.getReqParams(query, res);
  }

  @Get('verify-identity')
  getUserCredentials(@Query() query: any, @Res() res: Response) {
    this.appService.handleVerificationButtonClick(query, res);
  }
}
