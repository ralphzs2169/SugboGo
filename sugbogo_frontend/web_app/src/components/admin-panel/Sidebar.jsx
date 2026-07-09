import { NavLink } from 'react-router-dom'
import UsersLinkDropdown from './UsersLinkDropdown'
import SugboGoText from '../SugboGoText'
import {
  FiBarChart2,
  FiGrid,
  FiLogOut,
  FiSettings,
  FiShield,
  FiTag,
  FiUser,
} from 'react-icons/fi'

const navigation = [
  { to: '/admin-panel/explorer-activity', label: 'Explorer Activity', Icon: FiUser },
  { to: '/admin-panel/specialty-tags', label: 'Specialty Tags', Icon: FiTag },
  { to: '/admin-panel/flags-suspicious', label: 'Flags/Suspicious', Icon: FiShield },
  { to: '/admin-panel/analytics', label: 'Analytics', Icon: FiBarChart2 },
  { to: '/admin-panel/settings', label: 'Settings', Icon: FiSettings },
]

const linkBase =
  'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-[13px] font-medium transition duration-200'

function SidebarLink({ to, label, Icon, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `${linkBase} ${
          isActive
            ? 'bg-primary text-white'
            : 'text-text-primary hover:bg-sidebar-hover'
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

export default function Sidebar({
  onLogout,
  isOpen,
  onClose,
}) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-screen w-64 flex-col overflow-y-auto
          border-r border-stroke bg-background-primary
          transition-transform duration-300 ease-in-out

          ${isOpen ? 'translate-x-0' : '-translate-x-full'}

          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="px-6 pt-4">
          <div className="flex flex-col gap-1">
            <p className="text-3xl font-extrabold leading-none">
              <SugboGoText includeLogo />
            </p>

            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
              SUPER ADMIN CONSOLE
            </p>
          </div>
        </div>

        <nav className="flex-1  px-4 py-6">
          <SidebarLink
            to="/admin-panel/dashboard"
            label="Dashboard"
            Icon={FiGrid}
            onClick={onClose}
          />

          <SidebarLink
            to="/admin-panel/msmes"
            label="MSMEs"
            Icon={FiShield}
            onClick={onClose}
          />

          <UsersLinkDropdown />

          {navigation.map(({ to, label, Icon }) => (
            <SidebarLink
              key={to}
              to={to}
              label={label}
              Icon={Icon}
              onClick={onClose}
            />
          ))}
        </nav>

        <div className="border-t border-stroke px-4 py-4">
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-[13px] font-medium text-red-500 transition duration-200 hover:bg-red-50"
          >
            <FiLogOut className="h-5 w-5 shrink-0" />
            <span className="truncate">Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}