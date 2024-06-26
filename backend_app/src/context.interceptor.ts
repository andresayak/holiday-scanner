import {CallHandler, ExecutionContext, Injectable, NestInterceptor} from '@nestjs/common'
import {Observable} from 'rxjs'
@Injectable()
export class ContextInterceptor implements NestInterceptor {
    intercept(
        context: ExecutionContext,
        next: CallHandler
    ): Observable<any> {
        const request = context.switchToHttp().getRequest();
        request.body.context = request.params;
        return next.handle();
    }
}
