import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignupForm } from '@/components/auth/SignupForm'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

export default function LoginPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('login')

  useEffect(() => {
    if (!loading && session) {
      navigate('/projects', { replace: true })
    }
  }, [session, loading, navigate])

  if (loading) return null

  return (
    <div className="gradient-mesh flex min-h-screen items-center justify-center p-4">
      <Card className="glass w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Agentii</CardTitle>
          <CardDescription>
            {tab === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">
                Login
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Sign up
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup">
              <SignupForm />
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <OAuthButtons />
        </CardContent>
      </Card>
    </div>
  )
}
