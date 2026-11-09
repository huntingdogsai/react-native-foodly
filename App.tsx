import React, {useCallback, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addToCart,
  formatPrice,
  placeOrder,
  searchProducts,
  signIn,
  signOut,
  validatePromo,
  type CartItem,
  type Order,
  type Product,
  type User,
} from './src/api';
import {loadFavourites, saveFavourites} from './src/favourites';

type Screen = 'signin' | 'home' | 'cart' | 'checkout' | 'confirmed';

interface Draft {
  fullName: string;
  phone: string;
  address: string;
  promoCode: string;
}

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('signin');
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [draft, setDraft] = useState<Draft>({fullName: '', phone: '', address: '', promoCode: ''});
  const [discount, setDiscount] = useState(0);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleSignIn = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const {user: signedIn} = await signIn(email, password);
      setUser(signedIn);
      setDraft(prev => ({...prev, fullName: signedIn.name}));
      setFavourites(await loadFavourites(signedIn.id));
      setProducts(await searchProducts());
      setScreen('home');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }, [email, password]);

  const toggleFavourite = useCallback(
    (productId: string) => {
      if (!user) return;
      setFavourites(prev => {
        const next = prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId];
        void saveFavourites(user.id, next); // keep it on the device
        return next;
      });
    },
    [user],
  );

  const handleAddToCart = useCallback(async (product: Product) => {
    setError('');
    try {
      const result = await addToCart(product.id, 1);
      setCart(result.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add to cart');
    }
  }, []);

  const handlePlaceOrder = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const placed = await placeOrder(cart, {...draft, email: user?.email}, discount);
      setOrder(placed);
      setScreen('confirmed');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Order could not be placed');
    } finally {
      setBusy(false);
    }
  }, [cart, draft, discount, user]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setUser(null);
    setCart([]);
    setFavourites([]);
    setOrder(null);
    setScreen('signin');
  }, []);

  if (screen === 'signin') {
    return (
      <ScrollView contentContainerStyle={styles.signin}>
        <Text style={styles.h1}>Sign in to Foodly</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          accessibilityLabel="Email"
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          accessibilityLabel="Password"
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button label={busy ? 'Signing in…' : 'Sign in'} onPress={handleSignIn} disabled={busy} />
      </ScrollView>
    );
  }

  const favouriteProducts = products.filter(product => favourites.includes(product.id));

  return (
    <ScrollView contentContainerStyle={styles.app}>
      <View style={styles.bar}>
        <Text style={styles.brand}>Foodly</Text>
        {user ? <Text style={styles.muted}>{user.name} · {user.loyaltyTier}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {screen === 'home' && (
        <View>
          <View style={styles.searchRow}>
            <TextInput
              accessibilityLabel="Search products"
              style={[styles.input, styles.grow]}
              placeholder="Search…"
              value={query}
              onChangeText={setQuery}
            />
            <Button label="Find" onPress={async () => setProducts(await searchProducts(query))} />
          </View>

          <Text style={styles.h2}>Favourites</Text>
          {favouriteProducts.length === 0 ? (
            <Text style={styles.muted}>Tap the heart on a product to keep it here.</Text>
          ) : (
            favouriteProducts.map(product => (
              <ProductRow key={product.id} product={product} favourite onToggleFavourite={toggleFavourite} onAddToCart={handleAddToCart} />
            ))
          )}

          <Text style={styles.h2}>Menu</Text>
          {products.map(product => (
            <ProductRow
              key={product.id}
              product={product}
              favourite={favourites.includes(product.id)}
              onToggleFavourite={toggleFavourite}
              onAddToCart={handleAddToCart}
            />
          ))}

          <View style={styles.footerRow}>
            <Button label={`Cart (${cart.length})`} onPress={() => setScreen('cart')} />
            <Button label="Sign out" onPress={handleSignOut} />
          </View>
        </View>
      )}

      {screen === 'cart' && (
        <View>
          <Text style={styles.h2}>Your cart</Text>
          {cart.length === 0 ? (
            <Text style={styles.muted}>Your cart is empty.</Text>
          ) : (
            cart.map(item => (
              <View style={styles.row} key={item.productId}>
                <Text style={styles.grow}>{item.name} × {item.quantity}</Text>
                <Text>{formatPrice(item.price * item.quantity)}</Text>
              </View>
            ))
          )}
          <View style={styles.row}><Text style={styles.grow}>Subtotal</Text><Text style={styles.bold}>{formatPrice(subtotal)}</Text></View>
          {/* Clear cart empties the basket in one tap; disabled while the cart is already empty. */}
          <View style={styles.footerRow}>
            <Button label="Back" onPress={() => setScreen('home')} />
            <Button label="Clear cart" onPress={() => setCart([])} disabled={cart.length === 0} />
            <Button label="Checkout" onPress={() => setScreen('checkout')} disabled={cart.length === 0} />
          </View>
        </View>
      )}

      {screen === 'checkout' && (
        <View>
          <Text style={styles.h2}>Checkout</Text>
          <TextInput accessibilityLabel="Full name" style={styles.input} placeholder="Full name" value={draft.fullName} onChangeText={t => setDraft(p => ({...p, fullName: t}))} />
          <TextInput accessibilityLabel="Phone" style={styles.input} placeholder="Phone" keyboardType="phone-pad" value={draft.phone} onChangeText={t => setDraft(p => ({...p, phone: t}))} />
          <TextInput accessibilityLabel="Address" style={styles.input} placeholder="Address" value={draft.address} onChangeText={t => setDraft(p => ({...p, address: t}))} />
          <View style={styles.searchRow}>
            <TextInput accessibilityLabel="Promo code" style={[styles.input, styles.grow]} placeholder="Promo code" value={draft.promoCode} onChangeText={t => setDraft(p => ({...p, promoCode: t}))} />
            <Button label="Apply" onPress={async () => setDiscount((await validatePromo(draft.promoCode, subtotal)).discount)} />
          </View>
          <View style={styles.row}><Text style={styles.grow}>Total</Text><Text style={styles.bold}>{formatPrice(subtotal - discount)}</Text></View>
          <View style={styles.footerRow}>
            <Button label="Back" onPress={() => setScreen('cart')} />
            <Button label={busy ? 'Placing…' : 'Place order'} onPress={handlePlaceOrder} disabled={busy} />
          </View>
        </View>
      )}

      {screen === 'confirmed' && order && (
        <View style={styles.confirmed}>
          <Text style={styles.h2}>Order confirmed</Text>
          <Text>Order {order.id} · {formatPrice(order.total)}</Text>
          <Text style={styles.muted}>Your food is on the way.</Text>
          <Button label="Back to menu" onPress={() => setScreen('home')} />
        </View>
      )}
    </ScrollView>
  );
}

function ProductRow({product, favourite, onToggleFavourite, onAddToCart}: {
  product: Product;
  favourite: boolean;
  onToggleFavourite: (id: string) => void;
  onAddToCart: (product: Product) => void;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.grow}>
        {product.name} <Text style={styles.muted}>{formatPrice(product.price)}{product.inStock ? '' : ' · Sold out'}</Text>
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favourite ? `Remove ${product.name} from favourites` : `Add ${product.name} to favourites`}
        onPress={() => onToggleFavourite(product.id)}>
        <Text style={styles.heart}>{favourite ? '♥' : '♡'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${product.name} to cart`}
        disabled={!product.inStock}
        onPress={() => onAddToCart(product)}>
        <Text style={[styles.add, !product.inStock && styles.disabled]}>Add</Text>
      </Pressable>
    </View>
  );
}

function Button({label, onPress, disabled}: {label: string; onPress: () => void; disabled?: boolean}): React.JSX.Element {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  app: {padding: 16, gap: 4},
  signin: {padding: 16, paddingTop: 64, gap: 12},
  bar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0e2d8'},
  brand: {fontSize: 18, fontWeight: '700', color: '#e8622c'},
  h1: {fontSize: 22, fontWeight: '700'},
  h2: {fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 6},
  input: {borderWidth: 1, borderColor: '#f0e2d8', borderRadius: 10, padding: 10, backgroundColor: '#fff'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0e2d8'},
  searchRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10},
  footerRow: {flexDirection: 'row', gap: 10, marginTop: 16},
  grow: {flex: 1},
  bold: {fontWeight: '700'},
  muted: {color: '#8a7a70'},
  error: {color: '#c0392b'},
  heart: {fontSize: 20, color: '#e8622c', paddingHorizontal: 6},
  add: {color: '#e8622c', fontWeight: '700', paddingHorizontal: 6},
  disabled: {opacity: 0.4},
  button: {backgroundColor: '#e8622c', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14},
  buttonText: {color: '#fff', fontWeight: '600'},
  confirmed: {alignItems: 'center', gap: 8, paddingTop: 32},
});

export default App;
