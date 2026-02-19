package com.example.crypto_platform.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReplayConfigDto {
    private String symbol;
    private String interval;
    private Long startTime;
    private Long endTime;
}