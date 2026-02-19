package com.example.crypto_platform.repository;

import com.example.crypto_platform.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountRepository extends JpaRepository<Account, Long> {
    // Wir haben nur einen Account (Single-User System)
}