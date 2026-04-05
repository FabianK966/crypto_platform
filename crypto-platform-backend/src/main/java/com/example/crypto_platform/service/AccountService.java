package com.example.crypto_platform.service;

import com.example.crypto_platform.entity.Account;
import com.example.crypto_platform.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public Account register(String username, String password) {
        if (accountRepository.existsByUsername(username)) {
            throw new RuntimeException("Username already taken");
        }
        Account account = new Account();
        account.setUsername(username);
        account.setPasswordHash(passwordEncoder.encode(password));
        account.setInitialBalance(BigDecimal.ZERO);
        account.setTotalRealizedProfit(BigDecimal.ZERO);
        return accountRepository.save(account);
    }

    public Account login(String username, String password) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));
        if (!passwordEncoder.matches(password, account.getPasswordHash())) {
            throw new RuntimeException("Invalid credentials");
        }
        return account;
    }

    /**
     * Hole den Account des aktuell authentifizierten Benutzers
     */
    @Transactional
    public Account getOrCreateAccount() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) {
            throw new RuntimeException("Not authenticated");
        }
        String username = authentication.getName();
        return accountRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Account not found for user: " + username));
    }

    /**
     * Initial Balance erhöhen (Geld einzahlen)
     */
    @Transactional
    public Account depositMoney(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Deposit amount must be positive!");
        }

        Account account = getOrCreateAccount();
        account.setInitialBalance(account.getInitialBalance().add(amount));
        return accountRepository.save(account);
    }

    /**
     * Initial Balance reduzieren (Geld abheben)
     */
    @Transactional
    public Account withdrawMoney(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Withdrawal amount must be positive!");
        }

        Account account = getOrCreateAccount();

        if (account.getInitialBalance().compareTo(amount) < 0) {
            throw new RuntimeException("Insufficient balance! Available: $" +
                    account.getInitialBalance() + ", Requested: $" + amount);
        }

        account.setInitialBalance(account.getInitialBalance().subtract(amount));
        return accountRepository.save(account);
    }

    /**
     * Initial Balance direkt setzen (überschreiben)
     */
    @Transactional
    public Account setInitialBalance(BigDecimal newBalance) {
        Account account = getOrCreateAccount();
        account.setInitialBalance(newBalance);
        return accountRepository.save(account);
    }

    /**
     * Realized Profit aktualisieren
     */
    @Transactional
    public void addRealizedProfit(BigDecimal profit) {
        Account account = getOrCreateAccount();
        account.setTotalRealizedProfit(
                account.getTotalRealizedProfit().add(profit)
        );
        accountRepository.save(account);
    }
}