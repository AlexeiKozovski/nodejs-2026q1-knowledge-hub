import { Global, Module } from '@nestjs/common';
import { KnowledgeHubStore } from './knowledge-hub.store';

@Global()
@Module({
  providers: [KnowledgeHubStore],
  exports: [KnowledgeHubStore],
})
export class StorageModule {}
