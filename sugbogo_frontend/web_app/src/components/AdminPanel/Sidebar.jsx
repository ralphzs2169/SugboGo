import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import UsersLinkDropdown from './UsersLinkDropdown'
import {
	FiBarChart2,
	FiChevronDown,
	FiGrid,
	FiHelpCircle,
	FiLogOut,
	FiSettings,
	FiShield,
	FiTag,
	FiUser,
	FiUsers,
} from 'react-icons/fi'

const navigation = [
	{ to: '/admin-panel/explorer-activity', label: 'Explorer Activity', Icon: FiUser },
	{ to: '/admin-panel/specialty-tags', label: 'Specialty Tags', Icon: FiTag },
	{ to: '/admin-panel/flags-suspicious', label: 'Flags/Suspicious', Icon: FiShield },
	{ to: '/admin-panel/analytics', label: 'Analytics', Icon: FiBarChart2 },
	{ to: '/admin-panel/settings', label: 'Settings', Icon: FiSettings },
]

const linkBase =
	'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition duration-200'

function SidebarLink({ to, label, Icon }) {
	return (
		<NavLink
			to={to}
			className={({ isActive }) =>
				`${linkBase} ${isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-orange-50'}`
			}
		>
			<Icon className="h-5 w-5 shrink-0" />
			<span className="truncate">{label}</span>
		</NavLink>
	)
}

export default function Sidebar({ onLogout }) {
	return (
		<aside className="fixed inset-y-0 left-0 z-40 flex h-screen w-72 flex-col overflow-y-auto border-r border-gray-200 bg-white">
			<div className="border-b border-gray-100 px-6 py-6">
				<div className="flex items-center gap-3">
					
					<div className="flex flex-col gap-2">
						<p className="text-3xl font-extrabold leading-none">
							<span className="text-primary">Sugbo</span>
							<span className="text-gray-900">Go</span>
						</p>
						<p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">
							SUPER ADMIN CONSOLE
						</p>
					</div>
				</div>
			</div>

			<nav className="flex-1 space-y-2 px-4 py-6">
				<SidebarLink to="/admin-panel/dashboard" label="Dashboard" Icon={FiGrid} />
				<SidebarLink to="/admin-panel/msmes" label="MSMEs" Icon={FiShield} />
				<UsersLinkDropdown />
				{navigation.map(({ to, label, Icon }) => (
					<SidebarLink key={to} to={to} label={label} Icon={Icon} />
				))}
			</nav>

			<div className="border-t border-gray-100 px-4 py-4">
				{/* <SidebarLink to="/admin-panel/support" label="Support" Icon={FiHelpCircle} /> */}
				<button
					type="button"
					onClick={onLogout}
						className="mt-2 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition duration-200 hover:bg-red-50"
						style={{ color: 'var(--color-primary)' }}
				>
					<FiLogOut className="h-5 w-5 shrink-0" />
					<span className="truncate">Logout</span>
				</button>
			</div>
		</aside>
	)
}
