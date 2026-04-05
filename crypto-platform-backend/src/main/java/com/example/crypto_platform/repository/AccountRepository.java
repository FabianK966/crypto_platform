package com.example.crypto_platform.repository;

import com.example.crypto_platform.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountRepository extends JpaRepository<Account, Long> {
    java.util.Optional<Account> findByUsername(String username);
    boolean existsByUsername(String username);
}