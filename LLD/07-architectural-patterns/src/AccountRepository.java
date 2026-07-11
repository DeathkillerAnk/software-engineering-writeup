import java.util.Optional;

/**
 * DRILL · 07 — the PORT (a driven port, in Hexagonal terms).
 *
 * This interface is owned by the DOMAIN. The domain says "find account 42 / save this account" and
 * knows nothing about HOW (SQL, DynamoDB, a HashMap). Production provides a JdbcAccountRepository;
 * the test provides an InMemoryAccountRepository. Same core, swappable adapters — that's the point.
 */
public interface AccountRepository {
    Optional<Account> findById(String id);
    void save(Account account);
}
