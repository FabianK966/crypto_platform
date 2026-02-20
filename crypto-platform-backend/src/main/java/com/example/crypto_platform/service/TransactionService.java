package com.example.crypto_platform.service;

import com.example.crypto_platform.entity.Transaction;
import com.example.crypto_platform.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;

    @Transactional
    public void deleteTransactions(String symbol) {

        /**
         * Löscht alle Transaktionen für das Symbol
         */
        transactionRepository.deleteBySymbol(symbol);
    }
}
