
import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    query,
    orderBy,
    where,
    getDocs,
    writeBatch,
    increment,
    Unsubscribe
} from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, googleProvider } from '../firebaseConfig';
import { Material, Customer, PricingRule, Slip, Estimate, PurchaseOrder, AppSettings } from '../types';

const COLLECTIONS = {
    MATERIALS: 'materials',
    CUSTOMERS: 'customers',
    RULES: 'pricingRules',
    SLIPS: 'slips',
    ESTIMATES: 'estimates',
    PURCHASE_ORDERS: 'purchaseOrders',
    SETTINGS: 'settings'
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

const subscribe = <T extends { id: string }>(collectionName: string, callback: (data: T[]) => void): Unsubscribe => {
    const q = query(collection(db, collectionName), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => {
            const { id: _, ...docData } = doc.data() as any;
            // Ensure doc.id is used as the primary identifier
            return { ...docData, id: doc.id } as T;
        });
        callback(data);
    }, (err) => console.error(`Sync Error [${collectionName}]:`, err));
};

export const subscribeToMaterials = (cb: (m: Material[]) => void): Unsubscribe => subscribe<Material>(COLLECTIONS.MATERIALS, cb);
export const subscribeToCustomers = (cb: (c: Customer[]) => void): Unsubscribe => subscribe<Customer>(COLLECTIONS.CUSTOMERS, cb);
export const subscribeToPricingRules = (cb: (r: PricingRule[]) => void): Unsubscribe => subscribe<PricingRule>(COLLECTIONS.RULES, cb);
export const subscribeToSlips = (cb: (s: Slip[]) => void): Unsubscribe => subscribe<Slip>(COLLECTIONS.SLIPS, cb);
export const subscribeToEstimates = (cb: (e: Estimate[]) => void): Unsubscribe => subscribe<Estimate>(COLLECTIONS.ESTIMATES, cb);
export const subscribeToPurchaseOrders = (cb: (po: PurchaseOrder[]) => void): Unsubscribe => subscribe<PurchaseOrder>(COLLECTIONS.PURCHASE_ORDERS, cb);
export const subscribeToSettings = (cb: (s: AppSettings | null) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.SETTINGS));
    return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            cb(null);
        } else {
            const doc = snapshot.docs[0];
            cb({ id: doc.id, ...doc.data() } as any);
        }
    });
};

export const addMaterial = async (m: Omit<Material, 'id' | 'updatedAt'>) => {
    const { ...data } = m;
    const docRef = await addDoc(collection(db, COLLECTIONS.MATERIALS), { ...data, updatedAt: Date.now() });
    return docRef.id;
};

export const updateMaterial = async (id: string, m: Partial<Material>) => {
    const { id: _, ...data } = m as any;
    const docRef = doc(db, COLLECTIONS.MATERIALS, id);
    await updateDoc(docRef, { ...data, updatedAt: Date.now() });
};

export const deleteMaterial = async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.MATERIALS, id));
};

export const bulkDeleteMaterials = async (ids: string[]) => {
    const batch = writeBatch(db);
    ids.forEach(id => {
        const ref = doc(db, COLLECTIONS.MATERIALS, id);
        batch.delete(ref);
    });
    await batch.commit();
};

export const bulkUpdateMaterialsPrice = async (
    items: Material[],
    ids: string[],
    method: 'list_percent' | 'cost_markup' | 'list_to_cost',
    percent: number
) => {
    const batch = writeBatch(db);
    const selectedItems = items.filter(i => ids.includes(i.id));

    selectedItems.forEach(item => {
        let updateData: any = { updatedAt: Date.now() };

        if (method === 'list_percent' && item.listPrice > 0) {
            updateData.sellingPrice = Math.round(item.listPrice * (percent / 100));
        } else if (method === 'cost_markup' && item.costPrice > 0) {
            updateData.sellingPrice = Math.round(item.costPrice * (1 + (percent / 100)));
        } else if (method === 'list_to_cost' && item.listPrice > 0) {
            updateData.costPrice = Math.round(item.listPrice * (percent / 100));
        }

        if (Object.keys(updateData).length > 1) {
            const ref = doc(db, COLLECTIONS.MATERIALS, item.id);
            batch.update(ref, updateData);
        }
    });
    await batch.commit();
};

export const bulkSetCategory = async (ids: string[], newCategory: string) => {
    const batch = writeBatch(db);
    ids.forEach(id => {
        const ref = doc(db, COLLECTIONS.MATERIALS, id);
        batch.update(ref, { category: newCategory, updatedAt: Date.now() });
    });
    await batch.commit();
};

export const importMaterials = async (items: Partial<Material>[]) => {
    const batch = writeBatch(db);
    items.forEach(item => {
        const { id: _, ...data } = item as any;
        const ref = doc(collection(db, COLLECTIONS.MATERIALS));
        batch.set(ref, { ...data, updatedAt: Date.now() });
    });
    await batch.commit();
};

export const addCustomer = async (c: Omit<Customer, 'id'>) => {
    const docRef = await addDoc(collection(db, COLLECTIONS.CUSTOMERS), { ...c, updatedAt: Date.now() });
    return docRef.id;
};
export const updateCustomer = async (id: string, c: Partial<Customer>) => {
    const docRef = doc(db, COLLECTIONS.CUSTOMERS, id);
    await updateDoc(docRef, { ...c, updatedAt: Date.now() });
};
export const deleteCustomer = (id: string) => deleteDoc(doc(db, COLLECTIONS.CUSTOMERS, id));

export const addPricingRule = async (r: Omit<PricingRule, 'id'>) => {
    const docRef = await addDoc(collection(db, COLLECTIONS.RULES), { ...r, updatedAt: Date.now() });
    return docRef.id;
};
export const deletePricingRule = (id: string) => deleteDoc(doc(db, COLLECTIONS.RULES, id));

export const addSlip = async (s: Omit<Slip, 'id'>) => {
    const docRef = await addDoc(collection(db, COLLECTIONS.SLIPS), { ...s, updatedAt: Date.now() });
    return docRef.id;
};
export const updateSlip = async (id: string, data: Partial<Slip>) => {
    const docRef = doc(db, COLLECTIONS.SLIPS, id);
    await updateDoc(docRef, { ...data, updatedAt: Date.now() });
};
export const deleteSlip = (id: string) => deleteDoc(doc(db, COLLECTIONS.SLIPS, id));

const removeUndefined = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefined(item));
    }
    if (typeof obj === 'object' && obj !== null) {
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            if (value !== undefined) {
                cleaned[key] = removeUndefined(value);
            }
        });
        return cleaned;
    }
    return obj;
};

const sanitizeData = (obj: any, isRoot = true) => {
    const sanitized: any = {};
    Object.keys(obj).forEach(key => {
        if (key === 'id' && isRoot) return; // Only strip ID at the root level
        const value = obj[key];
        if (value === undefined) return;
        if (Array.isArray(value)) {
            sanitized[key] = value.map(item => (typeof item === 'object' && item !== null) ? sanitizeData(item, false) : item);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeData(value, false);
        } else {
            sanitized[key] = value;
        }
    });
    return sanitized;
};

export const addEstimate = async (e: Omit<Estimate, 'id'>) => {
    const data = sanitizeData(e);
    const docRef = await addDoc(collection(db, COLLECTIONS.ESTIMATES), { ...data, updatedAt: Date.now() });
    return docRef.id;
};

export const updateEstimate = async (id: string, e: Partial<Estimate>) => {
    const { id: _, ...rest } = e as any;
    const data = removeUndefined(rest);
    const docRef = doc(db, COLLECTIONS.ESTIMATES, id);
    await updateDoc(docRef, { ...data, updatedAt: Date.now() });
};
export const deleteEstimate = (id: string) => deleteDoc(doc(db, COLLECTIONS.ESTIMATES, id));

export const addPurchaseOrder = async (po: Omit<PurchaseOrder, 'id'>) => {
    const data = sanitizeData(po);
    const docRef = await addDoc(collection(db, COLLECTIONS.PURCHASE_ORDERS), { ...data, updatedAt: Date.now() });
    return docRef.id;
};

export const updatePurchaseOrder = async (id: string, po: Partial<PurchaseOrder>) => {
    const { id: _, ...rest } = po as any;
    const data = removeUndefined(rest);
    const docRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, id);
    await updateDoc(docRef, { ...data, updatedAt: Date.now() });
};

export const deletePurchaseOrder = (id: string) => deleteDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, id));

export const updateSettings = async (id: string, s: Partial<AppSettings>) => {
    const { id: _, ...rest } = s as any;
    const data = removeUndefined(rest);
    if (id === 'new') {
        return addDoc(collection(db, COLLECTIONS.SETTINGS), { ...data, updatedAt: Date.now() });
    }
    const docRef = doc(db, COLLECTIONS.SETTINGS, id);
    await updateDoc(docRef, { ...data, updatedAt: Date.now() });
};

export const updateMaterialQuantity = async (id: string, delta: number) => {
    const docRef = doc(db, COLLECTIONS.MATERIALS, id);
    await updateDoc(docRef, {
        quantity: increment(delta),
        updatedAt: Date.now()
    });
};

export const receivePurchaseOrderItems = async (items: { id: string, quantity: number }[]) => {
    const batch = writeBatch(db);
    items.forEach(item => {
        const ref = doc(db, COLLECTIONS.MATERIALS, item.id);
        batch.update(ref, {
            quantity: increment(item.quantity),
            updatedAt: Date.now()
        });
    });
    await batch.commit();
};

export const markSlipAsHandled = async (id: string) => {
    const docRef = doc(db, COLLECTIONS.SLIPS, id);
    await updateDoc(docRef, { isHandled: true, updatedAt: Date.now() });
};
