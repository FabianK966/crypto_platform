package com.example.crypto_platform.controller;

import com.example.crypto_platform.entity.Account;
import com.example.crypto_platform.service.AccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/account")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    /**
     * Account Info abrufen
     */
    @GetMapping
    public ResponseEntity<Account> getAccount() {
        return ResponseEntity.ok(accountService.getOrCreateAccount());
    }

    /**
     * Geld einzahlen (Initial Balance erhöhen)
     */
    @PostMapping("/deposit")
    public ResponseEntity<Account> deposit(@RequestParam BigDecimal amount) {
        return ResponseEntity.ok(accountService.depositMoney(amount));
    }

    /**
     * Geld abheben (Initial Balance reduzieren)
     */
    @PostMapping("/withdraw")
    public ResponseEntity<Account> withdraw(@RequestParam BigDecimal amount) {
        try {
            return ResponseEntity.ok(accountService.withdrawMoney(amount));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Initial Balance direkt setzen
     */
    @PutMapping("/balance")
    public ResponseEntity<Account> setBalance(@RequestParam BigDecimal amount) {
        return ResponseEntity.ok(accountService.setInitialBalance(amount));
    }
}