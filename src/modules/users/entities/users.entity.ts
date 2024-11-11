import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('user_test')
export class Users {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
    comment: '사용자 유일 식별자',
  })
  id: number;

  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
    comment: '사용자 이름',
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
    comment: '사용자 이메일',
  })
  email: string;

  @Column({
    name: 'created_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    comment: '사용자 등록 일시',
  })
  createdAt: Date;
}
