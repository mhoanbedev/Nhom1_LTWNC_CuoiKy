import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Global: module nào cần gửi email (hiện là applications) đều inject MailService. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
