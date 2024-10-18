import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Request, Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('callback-url/:username')
  async getReqParams(
    @Param('username') username: string,
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.appService.updateWorker({ ...query, username }, req, res);
  }

  @Get('verify-identity')
  getUserCredentials(@Query() query: any, @Res() res: Response) {
    this.appService.handleVerificationButtonClick(query, res);
  }
}
