export interface RepositoryError {
  readonly kind: 'persistence-failure';
  readonly operation: 'read' | 'write' | 'delete';
}
