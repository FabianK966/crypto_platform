package com.example.crypto_platform.repository;

import com.example.crypto_platform.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

     Optional<Transaction> findBySymbol(String symbol);

     void deleteBySymbol(String symbol);

    /**
     * Summiert alle realisierten Gewinne/Verluste aus SELL-Transaktionen.
     */
    @Query("SELECT SUM(t.realizedPnL) FROM Transaction t WHERE t.type = 'SELL'")
    BigDecimal getTotalRealizedPnL();
}