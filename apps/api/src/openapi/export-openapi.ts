/**
 * `make openapi` / `npm run openapi`: ghi tài liệu OpenAPI ra `apps/api/openapi.json`. Chạy lại mỗi
 * khi đổi API (route, DTO, decorator Swagger) rồi commit file; test e2e `openapi` báo lỗi nếu quên.
 */
import { writeFileSync } from 'node:fs';
import { OPENAPI_FILE, renderOpenApi } from './openapi-document';

async function main(): Promise<void> {
  const json = await renderOpenApi();
  writeFileSync(OPENAPI_FILE, json);
  const paths = Object.keys((JSON.parse(json) as { paths: object }).paths).length;
  console.log(`Đã ghi ${OPENAPI_FILE}: ${paths} đường dẫn.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
