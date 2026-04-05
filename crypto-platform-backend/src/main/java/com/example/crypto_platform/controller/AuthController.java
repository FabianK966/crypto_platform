package com.example.crypto_platform.controller;

import com.example.crypto_platform.dto.AuthResponseDto;
import com.example.crypto_platform.dto.LoginRequestDto;
import com.example.crypto_platform.dto.RegisterRequestDto;
import com.example.crypto_platform.entity.Account;
import com.example.crypto_platform.security.JwtUtil;
import com.example.crypto_platform.service.AccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class AuthController {

    private final AccountService accountService;
    private final JwtUtil jwtUtil;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequestDto request) {
        try {
            Account account = accountService.register(request.getUsername(), request.getPassword());
            String token = jwtUtil.generateToken(account.getUsername());
            return ResponseEntity.ok(new AuthResponseDto(token, account.getUsername()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDto request) {
        try {
            Account account = accountService.login(request.getUsername(), request.getPassword());
            String token = jwtUtil.generateToken(account.getUsername());
            return ResponseEntity.ok(new AuthResponseDto(token, account.getUsername()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(e.getMessage());
        }
    }
}
