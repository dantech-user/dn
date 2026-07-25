# HydraCity

Smart Living — app premium em React Native + Expo + TypeScript.

## Status deste build

Esta é a **Etapa 1**: estrutura completa do projeto.

Incluído nesta etapa:
- ✅ Projeto Expo + TypeScript configurado (aliases `@theme`, `@components`, etc.)
- ✅ Sistema de tema completo (dark/light, cores neon-blue, tipografia, espaçamento, sombras/glow) com persistência via AsyncStorage
- ✅ Biblioteca de componentes base: `Button`, `Input`, `GlassCard`, `Badge`, `Chip`, `Avatar`, `Skeleton`/`SkeletonCard`, `Toast`, `BottomSheet`, `AppModal`
- ✅ Navegação: Auth Stack (Splash/Login/SignUp/ForgotPassword) + Bottom Tab Navigator customizado com 5 abas em vidro (glass), sem Drawer, com ícone que aumenta/brilha e label que aparece na aba ativa
- ✅ `AuthContext` (mock, pronto para plugar API real) controlando o fluxo Auth vs Main
- ✅ Todas as 12 telas existem como placeholders já conectados à navegação e ao tema, prontas para receber o design final

Ainda **não** incluído (próximas etapas): animação real da splash screen com partículas/logo desenhado, telas de Login/Criar Conta completas, Home com dashboard, Mapa, Serviços, Notificações, Perfil/Configurações completos, logo vetorial original.

## Rodando o projeto

```bash
npm install
npx expo start
```

Requer Expo CLI e um simulador iOS/Android, Expo Go, ou o Expo Web.

## Estrutura

```
src/
  theme/        cores, tipografia, espaçamento, ThemeContext (dark/light)
  components/   biblioteca de componentes reutilizáveis
  navigation/   AuthNavigator, MainTabNavigator (bottom bar customizada), RootNavigator
  screens/      uma tela por rota (placeholders nesta etapa)
  context/      AuthContext
  constants/    nome do app, timings de animação, URL base da API
  types/        tipos compartilhados (ServiceItem, NotificationItem, MapMarkerItem)
  hooks/        (vazio — hooks compartilhados entram aqui)
  services/     (vazio — chamadas de API entram aqui)
  utils/        (vazio — helpers entram aqui)
```

## Próxima etapa sugerida

Fluxo de Splash + Login + Criar Conta com as animações completas (partículas, logo desenhado, glass forms).
