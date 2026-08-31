namespace CCMS.Domain.Interfaces;

public interface IUnitOfWork : IDisposable
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Runs <paramref name="operation"/> inside a database transaction, then saves and
    /// commits it — retrying the whole unit if the provider's execution strategy says a
    /// failure was transient.
    /// <para>
    /// This MUST be used instead of BeginTransactionAsync/CommitTransactionAsync wherever
    /// connection resiliency is enabled (see EnableRetryOnFailure in Program.cs). A
    /// retrying strategy cannot replay a hand-rolled transaction, so calling
    /// BeginTransactionAsync under one throws "does not support user-initiated
    /// transactions" at runtime and fails the request.
    /// </para>
    /// <para>
    /// Contract: <paramref name="operation"/> must be self-contained and safe to run more
    /// than once — do all reads and entity creation inside it, and never rely on state
    /// staged before the call, because the change tracker is reset before each attempt.
    /// Call SaveChangesAsync inside it if you need database-generated values (such as
    /// identity keys) before returning a result.
    /// </para>
    /// </summary>
    Task<T> ExecuteInTransactionAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken = default);

    /// <inheritdoc cref="ExecuteInTransactionAsync{T}"/>
    Task ExecuteInTransactionAsync(Func<CancellationToken, Task> operation, CancellationToken cancellationToken = default);

    Task BeginTransactionAsync(CancellationToken cancellationToken = default);
    Task CommitTransactionAsync(CancellationToken cancellationToken = default);
    Task RollbackTransactionAsync(CancellationToken cancellationToken = default);
}
