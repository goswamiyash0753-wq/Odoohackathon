// API Client for VendorBridge

const API_URL = 'http://localhost:5000/api';

class APIClient {
  constructor() {
    this.token = localStorage.getItem('px_token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('px_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('px_token');
  }

  getHeaders(isMultipart = false) {
    const headers = {
      Authorization: `Bearer ${this.token}`,
    };
    
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    
    return headers;
  }

  async request(method, endpoint, data = null) {
    const url = `${API_URL}${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders(),
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

  // Auth endpoints
  async register(userData) {
    return this.request('POST', '/auth/register', userData);
  }

  async login(email, password) {
    return this.request('POST', '/auth/login', { email, password });
  }

  async verify() {
    return this.request('GET', '/auth/verify');
  }

  async forgotPassword(email) {
    return this.request('POST', '/auth/forgot-password', { email });
  }

  // Vendor endpoints
  async getVendors(status = null, search = null) {
    let query = '/vendors';
    const params = [];
    
    if (status) params.push(`status=${status}`);
    if (search) params.push(`search=${search}`);
    
    if (params.length) query += '?' + params.join('&');
    return this.request('GET', query);
  }

  async getVendor(id) {
    return this.request('GET', `/vendors/${id}`);
  }

  async createVendor(vendorData) {
    return this.request('POST', '/vendors', vendorData);
  }

  async updateVendor(id, vendorData) {
    return this.request('PUT', `/vendors/${id}`, vendorData);
  }

  async deleteVendor(id) {
    return this.request('DELETE', `/vendors/${id}`);
  }

  // RFQ endpoints
  async getRFQs(status = null) {
    let query = '/rfqs';
    if (status) query += `?status=${status}`;
    return this.request('GET', query);
  }

  async getRFQ(id) {
    return this.request('GET', `/rfqs/${id}`);
  }

  async createRFQ(rfqData) {
    return this.request('POST', '/rfqs', rfqData);
  }

  async updateRFQStatus(id, status) {
    return this.request('PATCH', `/rfqs/${id}/status`, { status });
  }

  // Quotation endpoints
  async getQuotations(rfqId) {
    return this.request('GET', `/quotations/rfq/${rfqId}`);
  }

  async getQuotation(id) {
    return this.request('GET', `/quotations/${id}`);
  }

  async createQuotation(quotationData) {
    return this.request('POST', '/quotations', quotationData);
  }

  // Approval endpoints
  async createApproval(rfqId, quotationId) {
    return this.request('POST', '/approvals', { rfqId, quotationId });
  }

  async getApproval(id) {
    return this.request('GET', `/approvals/${id}`);
  }

  async approveApproval(id, remarks = '') {
    return this.request('PATCH', `/approvals/${id}/approve`, { remarks });
  }

  async rejectApproval(id, remarks = '') {
    return this.request('PATCH', `/approvals/${id}/reject`, { remarks });
  }

  // Purchase Order endpoints
  async getPurchaseOrders(vendorId = null, status = null) {
    let query = '/purchase-orders';
    const params = [];
    
    if (vendorId) params.push(`vendorId=${vendorId}`);
    if (status) params.push(`status=${status}`);
    
    if (params.length) query += '?' + params.join('&');
    return this.request('GET', query);
  }

  async getPurchaseOrder(id) {
    return this.request('GET', `/purchase-orders/${id}`);
  }

  async createPurchaseOrder(quotationId) {
    return this.request('POST', '/purchase-orders', { quotationId });
  }

  async updatePOStatus(id, status) {
    return this.request('PATCH', `/purchase-orders/${id}/status`, { status });
  }

  // Invoice endpoints
  async getInvoices(vendorId = null, status = null, paymentStatus = null) {
    let query = '/invoices';
    const params = [];
    
    if (vendorId) params.push(`vendorId=${vendorId}`);
    if (status) params.push(`status=${status}`);
    if (paymentStatus) params.push(`paymentStatus=${paymentStatus}`);
    
    if (params.length) query += '?' + params.join('&');
    return this.request('GET', query);
  }

  async getInvoice(id) {
    return this.request('GET', `/invoices/${id}`);
  }

  async createInvoice(poId, gstPercent = 18, dueDate = null) {
    return this.request('POST', '/invoices', { poId, gstPercent, dueDate });
  }

  async updateInvoicePayment(id, paymentStatus) {
    return this.request('PATCH', `/invoices/${id}/payment`, { paymentStatus });
  }

  // Activity endpoints
  async getActivity(limit = 50) {
    return this.request('GET', `/activity?limit=${limit}`);
  }

  async getUserActivity(userId) {
    return this.request('GET', `/activity/user/${userId}`);
  }
}

export default new APIClient();
