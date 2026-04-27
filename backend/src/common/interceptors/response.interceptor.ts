import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseData<T = any> {
  statusCode: number;
  message: string;
  data?: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseData<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseData<T>> {
    return next.handle().pipe(
      map(data => ({
        statusCode: context.switchToHttp().getResponse().statusCode,
        message: 'Success',
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
