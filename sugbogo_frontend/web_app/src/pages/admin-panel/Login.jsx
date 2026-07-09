import LoginCard from '../../components/login/LoginCard'
import useDocumentTitle from '../../hooks/useDocumentTitle'

function Login() {

  useDocumentTitle('Login | SugboGo Admin')

  return <LoginCard />
}

export default Login