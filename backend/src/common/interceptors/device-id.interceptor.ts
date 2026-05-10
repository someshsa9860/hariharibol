import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class DeviceIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const deviceId = request.headers['x-device-id'];

    if (deviceId) {
      request.deviceId = deviceId;
      if (request.user) {
        request.user.deviceId = request.user.deviceId || deviceId;
      }
    }

    return next.handle();
  }
}
