import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { LinkUserProfile } from '../types';
import { CheckCircle2, XCircle, Trash2, UserCheck, Search, Loader2 } from 'lucide-react';

export const LinkUserManagement: React.FC = () => {
    const [users, setUsers] = useState<LinkUserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const userList: LinkUserProfile[] = [];
            querySnapshot.forEach((doc) => {
                userList.push(doc.data() as LinkUserProfile);
            });
            setUsers(userList);
        } catch (error) {
            console.error("Error fetching users: ", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleApprove = async (uid: string, role: 'lite' | 'pro') => {
        if (!confirm(`このユーザーを ${role.toUpperCase()} 版として承認しますか？`)) return;
        try {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                isApproved: true,
                role: role,
                updatedAt: new Date().toISOString()
            });
            fetchUsers(); // Refresh list
        } catch (error) {
            console.error("Error approving user: ", error);
            alert("承認に失敗しました");
        }
    };

    const handleDelete = async (uid: string) => {
        if (!confirm("本当にこのユーザーを削除しますか？\nこの操作は取り消せません。")) return;
        try {
            await deleteDoc(doc(db, 'users', uid));
            fetchUsers();
        } catch (error) {
            console.error("Error deleting user: ", error);
            alert("削除に失敗しました");
        }
    };

    const filteredUsers = users.filter(user => {
        if (filter === 'pending') return !user.isApproved;
        if (filter === 'approved') return user.isApproved;
        return true;
    });

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                    <UserCheck className="text-blue-600" />
                    LINKユーザー管理
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        全て
                    </button>
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'pending' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        承認待ち
                        {users.filter(u => !u.isApproved).length > 0 && (
                            <span className="ml-2 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{users.filter(u => !u.isApproved).length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setFilter('approved')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'approved' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        承認済み
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="animate-spin text-blue-600" size={32} />
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">ステータス</th>
                                    <th className="px-6 py-4">会社名 / 氏名</th>
                                    <th className="px-6 py-4">連絡先</th>
                                    <th className="px-6 py-4">申請日時</th>
                                    <th className="px-6 py-4 text-right">アクション</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">ユーザーが見つかりません</td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                {user.isApproved ? (
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${user.role === 'pro' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                                        <CheckCircle2 size={14} />
                                                        {user.role === 'pro' ? 'PRO承認済み' : 'LITE承認済み'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-600">
                                                        <Loader2 size={14} className="animate-spin" />
                                                        承認待ち
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800">{user.companyName}</div>
                                                <div className="text-slate-500 text-xs">{user.displayName}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <div className="flex items-center gap-2">{user.email}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">{user.phoneNumber}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                                                {new Date(user.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {!user.isApproved && (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleApprove(user.uid, 'lite')}
                                                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shadow-sm"
                                                        >
                                                            LITE承認
                                                        </button>
                                                        <button
                                                            onClick={() => handleApprove(user.uid, 'pro')}
                                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                                        >
                                                            PRO承認
                                                        </button>
                                                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(user.uid)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2"
                                                    title="削除"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
