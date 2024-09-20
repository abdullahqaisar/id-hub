import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Request, Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('callback-url')
  async getReqParams(
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.appService.getReqParams(query, req, res);
  }

  @Get('verify-identity')
  getUserCredentials(@Query() query: any, @Res() res: Response) {
    this.appService.handleVerificationButtonClick(query, res);
  }
}
