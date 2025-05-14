class CircuitBreaker {
    constructor(options = {}) {
        this.request = options.request || axios;
        this.state = 'CLOSED';
        this.failureThreshold = options.failureThreshold || 3;
        this.timeout = options.timeout || 5000;
        this.resetTimeout = options.resetTimeout || 30000;
        this.failureCount = 0;
        this.nextAttempt = Date.now();
        this.fallback = options.fallback || (() => ({ status: 503, data: { message: 'Service unavailable' } }));
    }

    async execute(url, method = 'get', data = null) {
        if (this.state === 'OPEN' && Date.now() < this.nextAttempt) {
            return this.fallback(url, method, data);
        }

        if (this.state === 'OPEN') {
            this.state = 'HALF_OPEN';
        }

        try {
            const config = {
                method,
                url,
                data,
                timeout: this.timeout
            };

            const response = await this.request(config);

            if (this.state === 'HALF_OPEN') {
                this.state = 'CLOSED';
                this.failureCount = 0;
            }

            return response;
        } catch (error) {
            this.failureCount++;

            if (this.failureCount >= this.failureThreshold) {
                this.state = 'OPEN';
                this.nextAttempt = Date.now() + this.resetTimeout;
            }

            if (this.state === 'HALF_OPEN') {
                this.state = 'OPEN';
                this.nextAttempt = Date.now() + this.resetTimeout;
            }

            return this.fallback(url, method, data);
        }
    }

    async get(url) {
        return this.execute(url, 'get');
    }

    async put(url, data) {
        return this.execute(url, 'put', data);
    }
}

export default CircuitBreaker;