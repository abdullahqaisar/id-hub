import { Controller, Get, Query, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('callback-url')
  getReqParams(@Query() query: any, @Res() res: Response): void {
    this.appService.getReqParams(query, res);
  }
}
