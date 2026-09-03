import { ApiResponse, AuthResponse, IUserPublic } from '../../src/types';

export class AuthManager {
    private token: string | null = null;
    private baseURL: string;

    constructor() {
        this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        this.token = localStorage.getItem('authToken');
        console.log('AuthManager initialized with token:', this.token ? this.token.substring(0, 20) + '...' : 'null');
    }

    setToken(token: string): void {
        console.log('Setting token:', token.substring(0, 20) + '...');
        this.token = token;
        localStorage.setItem('authToken', token);
        console.log('Token saved to localStorage');
    }

    getToken(): string | null {
        return this.token;
    }

    isAuthenticated(): boolean {
        return this.token !== null;
    }

    logout(): void {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    private async makeRequest<T>(
        endpoint: string, 
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = `${this.baseURL}${endpoint}`;
        
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
            console.log('Making request with token:', this.token.substring(0, 20) + '...');
        } else {
            console.log('Making request without token');
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json();
            
            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Error del servidor'
                };
            }

            return data;
        } catch (error) {
            return {
                success: false,
                message: 'Error de conexión'
            };
        }
    }

    async login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
        const result = await this.makeRequest<AuthResponse>('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        // If login successful, set the token
        if (result.success && result.data?.token) {
            console.log('Login successful, setting token:', result.data.token.substring(0, 20) + '...');
            this.setToken(result.data.token);
        } else {
            console.log('Login failed:', result);
        }
        
        return result;
    }

    async register(username: string, email: string, password: string): Promise<ApiResponse<AuthResponse>> {
        const result = await this.makeRequest<AuthResponse>('/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        
        // If registration successful, set the token
        if (result.success && result.data?.token) {
            this.setToken(result.data.token);
        }
        
        return result;
    }

    async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
        return this.makeRequest<{ message: string }>('/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    async resetPassword(token: string, password: string): Promise<ApiResponse<{ message: string }>> {
        return this.makeRequest<{ message: string }>('/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password })
        });
    }

    async getProfile(): Promise<ApiResponse<IUserPublic>> {
        return this.makeRequest<IUserPublic>('/profile');
    }

    async validateWord(word: string): Promise<ApiResponse<{ valid: boolean }>> {
        return this.makeRequest<{ valid: boolean }>('/validate-word', {
            method: 'POST',
            body: JSON.stringify({ word })
        });
    }

    async joinMatchmaking(): Promise<ApiResponse<{ message: string }>> {
        return this.makeRequest<{ message: string }>('/matchmaking/join', {
            method: 'POST'
        });
    }

    async leaveMatchmaking(): Promise<ApiResponse<{ message: string }>> {
        return this.makeRequest<{ message: string }>('/matchmaking/leave', {
            method: 'POST'
        });
    }

    async getFriends(): Promise<ApiResponse<IUserPublic[]>> {
        return this.makeRequest<IUserPublic[]>('/friends');
    }

    async sendFriendRequest(friendUsername: string): Promise<ApiResponse<{ message: string }>> {
        return this.makeRequest<{ message: string }>('/friends/request', {
            method: 'POST',
            body: JSON.stringify({ friendUsername })
        });
    }

    // Daily Challenge methods
    async getDailyChallenge(): Promise<ApiResponse<any>> {
        return this.makeRequest<any>('/daily-challenge');
    }

    async completeDailyChallenge(words: string[]): Promise<ApiResponse<any>> {
        return this.makeRequest<any>('/daily-challenge/complete', {
            method: 'POST',
            body: JSON.stringify({ words })
        });
    }
}
