import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true // needed for refresh token cookie
});
export default instance;
