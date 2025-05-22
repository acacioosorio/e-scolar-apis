# Documentação do Módulo de Auditoria (Audit Trail)

## Introdução

O módulo de auditoria foi desenvolvido para registrar todas as ações realizadas pelos usuários no sistema de gestão escolar, permitindo rastreabilidade, transparência e segurança. Este documento explica como o sistema funciona e como integrá-lo a novos componentes.

## Arquitetura

O sistema de auditoria é composto por:

1. **Modelo de Dados (AuditLog)**: Armazena os registros de auditoria
2. **Middleware de Auditoria**: Captura automaticamente operações CRUD
3. **Serviço de Auditoria**: Fornece funções para casos especiais
4. **Controller de Auditoria**: Expõe APIs para consulta de logs
5. **Interface Administrativa**: Permite visualização e filtragem dos logs

## Como Integrar o Módulo de Auditoria

### 1. Integração via Middleware (Recomendado)

A maneira mais simples de integrar auditoria em um controller é usando os middlewares fornecidos:

```javascript
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const YourModel = require('./your.model');

// Criar com auditoria
router.post('/', auth, auditCreate('YourEntityType'), async (req, res) => {
    // Sua lógica de criação aqui
});

// Atualizar com auditoria
router.put('/:id', auth, auditUpdate('YourEntityType', YourModel), async (req, res) => {
    // Sua lógica de atualização aqui
});

// Excluir/arquivar com auditoria
router.delete('/:id', auth, auditDelete('YourEntityType', YourModel), async (req, res) => {
    // Sua lógica de exclusão/arquivamento aqui
});
```

### 2. Integração Manual via Serviço

Para casos especiais ou operações complexas, use o serviço de auditoria:

```javascript
const AuditService = require('../../api/audit/audit.service');

// Em algum lugar do seu código
await AuditService.createAuditLog(
    req.user,                // Usuário que realizou a ação
    schoolId,                // ID da escola
    'update',                // Tipo de ação (create, update, delete, archive, etc.)
    'YourEntityType',        // Tipo de entidade
    entityId,                // ID da entidade
    'Descrição da ação',     // Descrição em linguagem natural
    {                        // Detalhes adicionais (opcional)
        entityInfo: { name: 'Nome da entidade', identifier: 'Identificador' },
        changedFields: [{ field: 'campo', oldValue: 'valor antigo', newValue: 'novo valor' }],
        previousState: { /* estado anterior */ },
        newState: { /* novo estado */ },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    }
);
```

### 3. Integração com Login/Logout

Para auditar login e logout, use as funções específicas do serviço:

```javascript
// No controller de autenticação
const AuditService = require('../../api/audit/audit.service');

// Após login bem-sucedido
await AuditService.logLogin(user, req.ip, req.headers['user-agent']);

// Após logout
await AuditService.logLogout(user, req.ip, req.headers['user-agent']);
```

## Exemplos de Integração

### Exemplo 1: Controller de Alunos

```javascript
// ./api/students/students.controller.js
const express = require('express');
const router = express.Router();
const Student = require('./students.model');
const auth = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');

// Criar aluno com auditoria
router.post('/', auth, auditCreate('Student'), async (req, res) => {
    try {
        const student = new Student(req.body);
        await student.save();
        res.status(201).json(student);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criar aluno', error: error.message });
    }
});

// Atualizar aluno com auditoria
router.put('/:id', auth, auditUpdate('Student', Student), async (req, res) => {
    try {
        const student = await Student.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!student) return res.status(404).json({ message: 'Aluno não encontrado' });
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar aluno', error: error.message });
    }
});

// Arquivar aluno com auditoria
router.delete('/:id', auth, auditDelete('Student', Student), async (req, res) => {
    try {
        // Em vez de excluir, atualizamos o status para 'archived'
        const student = await Student.findByIdAndUpdate(
            req.params.id,
            { status: 'archived' },
            { new: true }
        );
        if (!student) return res.status(404).json({ message: 'Aluno não encontrado' });
        res.json({ message: 'Aluno arquivado com sucesso' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao arquivar aluno', error: error.message });
    }
});

module.exports = router;
```

### Exemplo 2: Alteração de Notas (Caso Especial)

```javascript
// ./api/marks/marks.controller.js
const express = require('express');
const router = express.Router();
const Mark = require('./marks.model');
const auth = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const AuditService = require('../audit/audit.service');

// Atualizar nota com auditoria especial
router.put('/:id', auth, async (req, res) => {
    try {
        // Buscar nota atual
        const currentMark = await Mark.findById(req.params.id);
        if (!currentMark) return res.status(404).json({ message: 'Nota não encontrada' });
        
        const oldGrade = currentMark.grade;
        const newGrade = req.body.grade;
        
        // Atualizar a nota
        const updatedMark = await Mark.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        // Registrar na auditoria com detalhes específicos para notas
        await AuditService.logGradeChange(
            req.user,
            currentMark,
            oldGrade,
            newGrade,
            req.ip,
            req.headers['user-agent']
        );
        
        res.json(updatedMark);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar nota', error: error.message });
    }
});

module.exports = router;
```

## Consultando Logs de Auditoria

### Via API

```javascript
// Exemplo de chamada à API de auditoria
const fetchAuditLogs = async (filters = {}) => {
    const queryParams = new URLSearchParams();
    
    if (filters.school) queryParams.append('school', filters.school);
    if (filters.user) queryParams.append('user', filters.user);
    if (filters.entityType) queryParams.append('entityType', filters.entityType);
    if (filters.action) queryParams.append('action', filters.action);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);
    
    const response = await fetch(`/api/audit?${queryParams.toString()}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
    
    if (!response.ok) {
        throw new Error('Falha ao buscar logs de auditoria');
    }
    
    return await response.json();
};
```

### Via Interface Administrativa

A interface administrativa de logs está disponível em:
```
/admin/audit-logs
```

Esta página permite:
- Visualizar todos os logs de auditoria
- Filtrar por tipo de entidade, ação, período, etc.
- Ver detalhes completos de cada log
- Exportar logs para análise externa

## Boas Práticas

1. **Sempre use os middlewares para operações padrão (CRUD)**
   - Eles capturam automaticamente o estado anterior e as alterações

2. **Use o serviço para casos especiais**
   - Operações em lote
   - Alterações de status críticos
   - Ações que não são CRUD padrão

3. **Mantenha descrições claras e informativas**
   - As descrições devem ser compreensíveis para usuários não técnicos
   - Inclua identificadores relevantes (nomes, códigos, etc.)

4. **Evite registrar dados sensíveis**
   - Não inclua senhas ou dados pessoais sensíveis nos logs
   - Considere mascarar informações confidenciais

5. **Monitore o crescimento da coleção de logs**
   - A coleção está configurada como "capped" para limitar o tamanho
   - Considere implementar uma política de retenção para logs antigos

## Solução de Problemas

### Logs não estão sendo registrados

1. Verifique se o middleware está corretamente aplicado à rota
2. Confirme que o usuário está autenticado (req.user existe)
3. Verifique se a resposta está sendo enviada com status de sucesso (2xx)

### Erros ao consultar logs

1. Verifique permissões do usuário (apenas admin e schoolAdmin podem ver logs)
2. Confirme que os filtros estão no formato correto
3. Verifique se a escola do usuário corresponde à escola dos logs (para schoolAdmin)

## Conclusão

O módulo de auditoria fornece rastreabilidade completa das ações no sistema, ajudando a garantir segurança, conformidade e transparência. Ao seguir as diretrizes deste documento, você pode integrar facilmente a auditoria em novos componentes do sistema.
