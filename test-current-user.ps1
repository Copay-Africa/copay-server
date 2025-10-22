# Test Current User API Endpoint

Write-Host "Testing Current User API Endpoint..." -ForegroundColor Green

# First, login to get a JWT token
try {
    Write-Host "`n1. Logging in to get JWT token..." -ForegroundColor Yellow
    
    $loginBody = @{
        phone = "+250788000001"  # Replace with a valid phone number
        pin = "123456"           # Replace with the correct PIN
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    $token = $loginResponse.accessToken
    Write-Host "✅ Login successful! Token obtained." -ForegroundColor Green
    Write-Host "User: $($loginResponse.user.firstName) $($loginResponse.user.lastName)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure you have a valid user account and update the phone/pin above." -ForegroundColor Yellow
    exit 1
}

# Test the current user endpoint
try {
    Write-Host "`n2. Getting current user profile..." -ForegroundColor Yellow
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $userResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/users/me" -Method GET -Headers $headers
    
    Write-Host "✅ Current user profile retrieved successfully!" -ForegroundColor Green
    Write-Host "User ID: $($userResponse.id)" -ForegroundColor Cyan
    Write-Host "Phone: $($userResponse.phone)" -ForegroundColor Cyan
    Write-Host "Name: $($userResponse.firstName) $($userResponse.lastName)" -ForegroundColor Cyan
    Write-Host "Role: $($userResponse.role)" -ForegroundColor Cyan
    Write-Host "Status: $($userResponse.status)" -ForegroundColor Cyan
    
    if ($userResponse.cooperative) {
        Write-Host "Cooperative: $($userResponse.cooperative.name) ($($userResponse.cooperative.code))" -ForegroundColor Cyan
        Write-Host "Cooperative Status: $($userResponse.cooperative.status)" -ForegroundColor Cyan
    } else {
        Write-Host "Cooperative: Not assigned" -ForegroundColor Yellow
    }
    
    if ($userResponse.lastLoginAt) {
        Write-Host "Last Login: $($userResponse.lastLoginAt)" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "❌ Failed to get current user: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Message -match "401") {
        Write-Host "The JWT token might be invalid or expired." -ForegroundColor Yellow
    } elseif ($_.Exception.Message -match "403") {
        Write-Host "User account might not be active." -ForegroundColor Yellow
    }
}

Write-Host "`n🎉 Current User API testing completed!" -ForegroundColor Green