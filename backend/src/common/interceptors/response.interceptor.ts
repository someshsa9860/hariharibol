import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, T> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<T> {
    // Services already return correctly structured responses:
    // - List endpoints: { data: [...], total: number }
    // - Single item endpoints: plain object
    // No outer wrapper added to avoid double-nesting.
    return next.handle();
  }
}
