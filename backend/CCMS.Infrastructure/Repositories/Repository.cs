using Microsoft.EntityFrameworkCore;
using CCMS.Domain.Entities;
using CCMS.Domain.Interfaces;
using CCMS.Infrastructure.Data;

namespace CCMS.Infrastructure.Repositories;

public class Repository<T> : IRepository<T> where T : BaseEntity
{
    protected readonly ApplicationDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(ApplicationDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public virtual async Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        // Use FirstOrDefaultAsync instead of FindAsync to respect global query filters
        return await _dbSet.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
    }

    public virtual async Task<IEnumerable<T>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        // Special handling for Booking to include navigation properties
        if (typeof(T) == typeof(Booking))
        {
            return (IEnumerable<T>)await _context.Bookings
                .Where(b => !b.IsDeleted)  // Filter out soft-deleted bookings
                .Include(b => b.Campaign)
                .Include(b => b.Screen)
                .Include(b => b.Creative)
                .ToListAsync(cancellationToken);
        }
        
        // For other entities, filter out soft-deleted records
        return await _dbSet.Where(e => !e.IsDeleted).ToListAsync(cancellationToken);
    }

    public virtual async Task<IEnumerable<T>> FindAsync(System.Linq.Expressions.Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
    {
        return await _dbSet.Where(predicate).ToListAsync(cancellationToken);
    }

    public virtual async Task<T> AddAsync(T entity, CancellationToken cancellationToken = default)
    {
        await _dbSet.AddAsync(entity, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        return entity;
    }

    public virtual async Task UpdateAsync(T entity, CancellationToken cancellationToken = default)
    {
        _dbSet.Update(entity);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public virtual async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await GetByIdAsync(id, cancellationToken);
        if (entity != null)
        {
            entity.IsDeleted = true;
            await UpdateAsync(entity, cancellationToken);
        }
   }

    public virtual async Task HardDeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await _dbSet.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (entity != null)
        {
            _dbSet.Remove(entity); // Physical removal
            // SaveChanges will be called by the caller
        }
    }

    public virtual async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbSet.AnyAsync(e => e.Id == id, cancellationToken);
    }

    public virtual async Task<int> CountAsync(System.Linq.Expressions.Expression<Func<T, bool>>? predicate = null, CancellationToken cancellationToken = default)
    {
        return predicate == null
            ? await _dbSet.CountAsync(cancellationToken)
            : await _dbSet.CountAsync(predicate, cancellationToken);
    }

    public virtual async Task<T?> FindOneIncludingDeletedAsync(System.Linq.Expressions.Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
    {
        // IgnoreQueryFilters to include soft-deleted records
        return await _dbSet.IgnoreQueryFilters().FirstOrDefaultAsync(predicate, cancellationToken);
    }

    public virtual async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.SaveChangesAsync(cancellationToken);
    }
}
