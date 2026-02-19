package com.example.crypto_platform.controller;

import com.example.crypto_platform.service.TransactionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transactions")
@CrossOrigin(origins = "http://localhost:4200", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {this.transactionService = transactionService;}

    @DeleteMapping("/{symbol}")
    public ResponseEntity<Void> deleteTransactions(@PathVariable String symbol) {
        transactionService.deleteTransactions(symbol);
        return ResponseEntity.noContent().build();
    }
}