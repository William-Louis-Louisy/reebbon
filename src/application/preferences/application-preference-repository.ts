import type { Result } from '../../domain';

import type { RepositoryError } from '../shared/repository-error';

export interface ApplicationPreference {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: Date;
}

export interface ApplicationPreferenceRepository {
  get(
    key: string,
  ): Promise<Result<ApplicationPreference | null, RepositoryError>>;
  save(
    preference: ApplicationPreference,
  ): Promise<Result<void, RepositoryError>>;
}
