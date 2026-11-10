import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  isLocale,
  LOCALES,
  type Locale,
  type NotificationItem,
  type Paginated,
  type ReadAllResult,
  type UnreadCount,
} from '@ltwnc/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../common/swagger/api-response.decorators';
import type { RequestUser } from '../../common/types/request-user';
import {
  NotificationItemDto,
  NotificationsQueryDto,
  ReadAllResultDto,
  UnreadCountDto,
} from './dto/notification.dto';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationsService } from './notifications.service';
import type { Observable } from 'rxjs';

/**
 * Câu chữ thông báo theo ngôn ngữ ưa thích của người nhận (`preferredLocale`); request có `?lang=`
 * hợp lệ thì ưu tiên `?lang` để hiện đúng ngôn ngữ giao diện đang xem.
 */
function localeOf(user: RequestUser, lang: unknown): Locale {
  return isLocale(lang) ? lang : user.preferredLocale;
}

const LANG_QUERY = {
  name: 'lang',
  enum: LOCALES,
  required: false,
  description: 'Không truyền thì dùng ngôn ngữ ưa thích của tài khoản',
} as const;

/** Mọi vai trò đã đăng nhập (không gắn @Roles). */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('me/notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly streamService: NotificationStreamService,
  ) {}

  @Get()
  @ApiQuery(LANG_QUERY)
  @ApiOperation({
    summary: 'Thông báo của tôi, mới nhất lên trước',
    description:
      '`?unread=true` chỉ lấy chưa đọc. Mỗi thông báo có `type`, `data` (tham số, có các id để dựng link) và `title`, `body` đã dịch.',
  })
  @ApiPaginatedResponse(NotificationItemDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: NotificationsQueryDto,
    @Query('lang') lang?: string,
  ): Promise<Paginated<NotificationItem>> {
    return this.notificationsService.list(user.id, query, localeOf(user, lang));
  }

  @Sse('stream')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'Số thông báo chưa đọc theo thời gian thực (SSE)',
    description:
      'Sự kiện `unread-count` (`{ count }`) gửi ngay khi kết nối và mỗi khi số đổi (thông báo mới sau khi commit, đọc một, đọc tất cả); `ping` mỗi 25 giây. Stream đóng khi access token hết hạn hoặc tài khoản bị khóa, frontend kết nối lại bằng token mới. Xác thực bằng header Authorization: trình duyệt đi qua Route Handler của Next làm proxy (EventSource không gửi được header). Swagger UI không hiển thị được stream; thử bằng curl -N.',
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  stream(@CurrentUser() user: RequestUser): Observable<MessageEvent> {
    return this.streamService.stream(user.id, user.tokenExpiresAt);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số thông báo chưa đọc (dự phòng khi không dùng stream)' })
  @ApiDataResponse(UnreadCountDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  unreadCount(@CurrentUser() user: RequestUser): Promise<UnreadCount> {
    return this.notificationsService.unreadCount(user.id);
  }

  @Patch(':id/read')
  @ApiQuery(LANG_QUERY)
  @ApiOperation({ summary: 'Đánh dấu đã đọc (gọi lại không đổi gì); của người khác trả 404' })
  @ApiDataResponse(NotificationItemDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  markRead(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('lang') lang?: string,
  ): Promise<NotificationItem> {
    return this.notificationsService.markRead(user.id, id, localeOf(user, lang));
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu tất cả đã đọc, trả số thông báo vừa đánh dấu' })
  @ApiDataResponse(ReadAllResultDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  markAllRead(@CurrentUser() user: RequestUser): Promise<ReadAllResult> {
    return this.notificationsService.markAllRead(user.id);
  }
}
