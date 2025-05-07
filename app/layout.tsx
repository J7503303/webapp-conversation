import { getLocaleOnServer } from '@/i18n/server'

import './styles/globals.css'
import './styles/markdown.scss'
import './styles/jinja-template.css'

const LocaleLayout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const locale = getLocaleOnServer()
  return (
    <html lang={locale ?? 'en'} className="h-full">
      <body className="h-full overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="min-h-screen w-full">
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}

export default LocaleLayout
