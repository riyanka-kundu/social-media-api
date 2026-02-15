import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Gender } from '@/common/enum';
import { Post } from '@/modules/posts/entities/post.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { nullable: false })
  name: string;

  @Column('text', { nullable: false })
  email: string;

  @Exclude()
  @Column({ type: 'text', nullable: false, select: false })
  password: string;

  @Column({ type: 'text', nullable: true })
  profilePicture?: string;

  @Column({
    type: 'text',
    enum: Gender,
    nullable: false,
    default: Gender.OTHER,
  })
  gender: Gender;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @OneToMany(() => Post, (post) => post.creator)
  posts: Post[];

  @Exclude()
  @Column({ type: 'simple-json', nullable: true, select: false })
  authTokens: string[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
