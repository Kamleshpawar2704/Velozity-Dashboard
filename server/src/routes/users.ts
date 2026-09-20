import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { bcrypt } from '../utils/auth.js';
import type { AuthedRequest } from '../types.js';
const router = Router();
router.get('/developers', requireAuth, async (_req, res) => { const users = await prisma.user.findMany({ where: { role: 'DEVELOPER' }, select: { id: true, name: true, email: true } }); res.json({ users }); });
router.get('/', requireAuth, allowRoles('ADMIN'), async (_req, res) => { const users = await prisma.user.findMany({ select: { id:true,name:true,email:true,role:true,createdAt:true }, orderBy:{createdAt:'desc'} }); res.json({ users }); });
router.post('/', requireAuth, allowRoles('ADMIN'), async (req, res, next) => { try { const body=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(8),role:z.enum(['ADMIN','PM','DEVELOPER'])}).parse(req.body); const user=await prisma.user.create({data:{name:body.name,email:body.email,passwordHash:await bcrypt.hash(body.password,10),role:body.role}}); res.status(201).json({user:{id:user.id,name:user.name,email:user.email,role:user.role}}); } catch(e){next(e)} });
router.get('/clients', requireAuth, allowRoles('ADMIN','PM'), async (_req, res) => { const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } }); res.json({ clients }); });
router.post('/clients', requireAuth, allowRoles('ADMIN'), async (req,res,next)=>{try{const body=z.object({name:z.string().min(2),email:z.string().email().optional()}).parse(req.body);const client=await prisma.client.create({data:body});res.status(201).json({client})}catch(e){next(e)}});
export default router;

router.patch('/:id', requireAuth, allowRoles('ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const body=z.object({name:z.string().min(2).optional(),email:z.string().email().optional(),password:z.string().min(8).optional(),role:z.enum(['ADMIN','PM','DEVELOPER']).optional()}).parse(req.body);
    const data:any={...body}; if(body.password){data.passwordHash=await bcrypt.hash(body.password,10);delete data.password;}
    const user=await prisma.user.update({where:{id:String(req.params.id)},data});
    res.json({user:{id:user.id,name:user.name,email:user.email,role:user.role}});
  } catch(e){next(e)}
});
router.delete('/:id', requireAuth, allowRoles('ADMIN'), async (req: AuthedRequest, res, next) => {
  try { if(String(req.params.id)===req.user!.id) return res.status(400).json({error:{code:'SELF_DELETE',message:'You cannot delete your own account'}}); await prisma.user.delete({where:{id:String(req.params.id)}}); res.json({ok:true}); } catch(e){next(e)}
});
router.patch('/clients/:id', requireAuth, allowRoles('ADMIN'), async (req,res,next)=>{try{const body=z.object({name:z.string().min(2).optional(),email:z.string().email().optional()}).parse(req.body);const client=await prisma.client.update({where:{id:String(req.params.id)},data:body});res.json({client})}catch(e){next(e)}});
router.delete('/clients/:id', requireAuth, allowRoles('ADMIN'), async (req,res,next)=>{try{const count=await prisma.project.count({where:{clientId:String(req.params.id)}});if(count)return res.status(409).json({error:{code:'CLIENT_IN_USE',message:'Client is assigned to existing projects'}});await prisma.client.delete({where:{id:String(req.params.id)}});res.json({ok:true})}catch(e){next(e)}});
