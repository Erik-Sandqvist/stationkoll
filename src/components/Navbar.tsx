import { useBranding } from '@/hooks/useBranding';
import { BrandSwitcher } from './BrandSwitcher';
import { ThemeToggle } from './ThemeToggle';

const Navbar = () => {
  const { branding } = useBranding();

  return (
    <nav className="fixed top-0 w-full z-50 py-6 bg-[rgba(8, 26, 58, 0.8)] backdrop-blur-lg shadow-lg border-b border-border">
      <div className="container mx-auto px-4 flex items-center justify-between">
        {branding.logoSrc ? (
          <img src={branding.logoSrc} alt={branding.logoAlt} className="h-8 w-auto" />
        ) : (
          <span className="text-lg font-semibold text-foreground">
            {branding.organizationName}
          </span>
        )}
        <h1 className="text-2xl font-bold text-foreground absolute left-1/2 transform -translate-x-1/2">
          {branding.appTitle}
        </h1>
        <div className="flex items-center gap-2">
          <BrandSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
