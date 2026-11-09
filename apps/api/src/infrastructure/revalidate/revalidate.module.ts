import { Global, Module } from '@nestjs/common';
import { RevalidateService } from './revalidate.service';

/** Global: mọi module ghi dữ liệu công khai (jobs, companies, admin) đều cần báo Next. */
@Global()
@Module({
  providers: [RevalidateService],
  exports: [RevalidateService],
})
export class RevalidateModule {}
