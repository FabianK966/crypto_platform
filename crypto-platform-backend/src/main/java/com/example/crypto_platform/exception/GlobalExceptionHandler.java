package com.example.crypto_platform.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.reactive.function.client.WebClientResponseException;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(WebClientResponseException.class)
    public ResponseEntity<String> handleBinanceError(WebClientResponseException ex) {
        String message = ex.getResponseBodyAsString();
        if (message == null || message.isEmpty()) {
            message = "Binance API Fehler: " + ex.getStatusCode();
        }
        return ResponseEntity.status(ex.getStatusCode()).body(message);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleGeneral(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Interner Fehler: " + ex.getMessage());
    }
}